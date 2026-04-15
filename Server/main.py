from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from ollama import Client
import os, re, json
import mokkari

# Load environment variables
load_dotenv()
METRON_USERNAME = os.getenv("METRON_USERNAME")
METRON_PASSWORD = os.getenv("METRON_PASSWORD")

# Set up Metron (mokkari) and Ollama clients
metron = mokkari.api(METRON_USERNAME, METRON_PASSWORD)
client = Client(host=os.getenv("OLLAMA_LOCAL_HOST"))

app = Flask(__name__)
CORS(app)

def get_comic_by_upc(upc):
    results = metron.issues_list(params={"upc": upc})
    if not results:
        return None
    return metron.issue(results[0].id)

def get_previous_issues(comic):
    series_id = comic.series.id
    all_issues = metron.issues_list(params={"series_id": series_id})
    if not all_issues:
        return []

    try:
        curr_num = float(comic.number)
    except (ValueError, TypeError):
        return []

    previous = []
    for issue in all_issues:
        try:
            issue_num = float(issue.number)
        except (ValueError, TypeError):
            continue
        if issue_num < curr_num:
            previous.append((issue_num, issue))

    # Sort newest to oldest, take top 5
    previous.sort(key=lambda x: x[0], reverse=True)
    previous = previous[:5]

    # Fetch full issue details (needed for desc field)
    full_issues = []
    for _, base_issue in previous:
        full_issue = metron.issue(base_issue.id)
        if full_issue:
            full_issues.append(full_issue)

    return full_issues

def clean_response(text):
    # Remove the think block from the deepseek-r1 model
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

def decode_supplementary_barcode(image: bytes):
    system_prompt = "You are a decoder of barcodes. Return only the decoded number."
    user_prompt = "From the image there are two barcodes. First one is a 12 digit upc and the second one is a supplementary ean barcode. Decode the second barcode."

    conversation = [
        {'role': 'system', 'content':  system_prompt},
        {'role': 'user', 'content':  user_prompt, 'images': [image]},
    ]

    response = client.chat(
        model='qwen2.5vl:7b',
        messages=conversation
    )

    return response['message']['content'].strip()

@app.route('/recap', methods=['POST'])
def handle_recap():
    raw_meta = request.form.get('metadata')
    if not raw_meta:
        return jsonify({"error": "Missing metadata part."}), 400

    try:
        meta = json.loads(raw_meta)
        upc = meta.get('code')
    except Exception:
        return jsonify({"error": "Invalid metadata JSON or code"}), 400

    img_file = request.files.get('image')
    if not img_file:
        return jsonify({"error": "Missing image file"}), 400

    print(f"[1/3] UPC from scanner: {upc}")

    # Read the uploaded image bytes
    img_bytes = img_file.read()

    # Use Ollama to decode the supplementary EAN-5 from the image
    try:
        ean = decode_supplementary_barcode(img_bytes)
    except Exception as e:
        print(f"[ERROR] Failed to decode EAN-5: {e}")
        return jsonify({"error": f"Failed to decode barcode image: {e}"}), 500
    print(f"[2/3] EAN-5 from Ollama: {ean}")

    full_upc = upc + ean
    print(f"[3/3] Full UPC sent to Metron API: {full_upc}")

    # Look up the comic using the full UPC, with fallback to 12-digit UPC-A
    try:
        comic = get_comic_by_upc(full_upc)
        if comic is None and len(full_upc) > 12:
            print(f"[FALLBACK] No result for full UPC, trying 12-digit: {upc}")
            comic = get_comic_by_upc(upc)
    except Exception as e:
        return jsonify({"error": f"Metron API error: {e}"}), 502

    system_prompt = "You are a comic book assistant that helps with making recaps of new issues of comics. Do no explain the issues, but respond directly with a recap of the stories. The output should not include: Here's a recap, <title>'s recap, <Issue #>, or any language other than english. Also make the output a short 2-3 paragraph response."

    if comic:
        # Build the issue title from series name and issue number
        issue_title = f"{comic.series.name} #{comic.number}"

        # Get the cover image URL
        thumbnail = str(comic.image) if comic.image else ""

        # Display the header
        message = f"Here's the recap leading up to {issue_title}:\n\n"

        # Find the previous issues to make a recap for the current comic
        try:
            previous_issues = get_previous_issues(comic)
        except Exception as e:
            return jsonify({"error": f"Metron API error: {e}"}), 502

        # Get all the summaries from the 5 previous issues
        if previous_issues:
            current_description = comic.desc or 'No description available.'
            user_prompt = f"Based on the previous summaries from {issue_title}, write a compelling recap of recent events that could appear at the beginning of the next issue. Focus on the key developments, tone, and stakes — as if you're reminding a returning reader of what they need to know before diving in. Here is the current description for the current issue to help make a recap: {current_description}\nHere are the previous summaries:"

            # Add the summary of each previous comic into the prompt
            for issue in previous_issues:
                issue_description = issue.desc or 'No description available.'
                user_prompt += f"Issue #{issue.number}: {issue_description}\n"

            # Feed the prompt with the summaries into an AI model to make a recap
            conversation = [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ]

            # Get the recap from the model
            try:
                response = client.chat(model='deepseek-r1:14b', messages=conversation)
                output = clean_response(response['message']['content'])
                message += output
            except Exception:
                return jsonify({
                    "message": "Failed to connect to Ollama. Make sure it's running."
                })

        else:
            # No previous issues -- display the current issue's description
            message += comic.desc or 'No description available.'

        return jsonify({
            "message": message,
            "thumbnail": thumbnail
        })

    else:
        return jsonify({
            "message": "No comic found for this UPC."
        }), 404

if __name__ == "__main__":
    app.run(debug=True)
