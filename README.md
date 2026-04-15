# AI Comic Book Recapper

Scan any comic book barcode with your camera and get an AI-generated recap of the story so far — instantly.

---

## Screenshots

| Camera View | Scanning | Results |
|----------|-------------|---------|
| ![Camera view](docs/images/screenshot-camera.png) | ![Scanning screen](docs/images/screenshot-scanning.png) | ![Results screen](docs/images/screenshot-results.png) |

---

## How It Works

The app runs a two-stage AI pipeline triggered by a single barcode scan:

```
Camera Feed
    │
    ▼
[Quagga2] ──── Reads 12-digit UPC-A barcode
    │
    ▼
[qwen2.5vl:7b] ── Decodes the supplementary EAN-5 barcode from the camera frame
    │                (standard barcode libraries cannot read this addon barcode)
    ▼
Full UPC (12-digit + 5-digit) sent to Metron.cloud API
    │
    ├── Fetches current issue: title, publisher, cover date, cover image, description
    └── Fetches 5 most recent previous issues in the same series
    │
    ▼
[deepseek-r1:14b] ── Generates a 2–3 paragraph "story so far" recap
    │                  from the current and previous issue descriptions
    ▼
Results displayed: cover image, metadata badges, and AI recap
```

### Why Two Barcodes?
Comic books have two barcodes printed on the cover: a standard **UPC-A** (12 digits) that identifies the series, and a smaller **EAN-5** addon (5 digits) that identifies the specific issue and variant. JavaScript barcode libraries can only decode the UPC-A. Rather than shipping a native barcode SDK, the app sends the camera frame to a local vision-language model that reads the EAN-5 directly from the image.

---

## Tech Stack

### Backend
| Component | Technology |
|-----------|------------|
| Server | Python / Flask 3.1 |
| Comic database | [Metron.cloud](https://metron.cloud) API via `mokkari` |
| Vision model | `qwen2.5vl:7b` via Ollama |
| Recap model | `deepseek-r1:14b` via Ollama |
| Environment config | `python-dotenv` |

### Frontend
| Component | Technology |
|-----------|------------|
| UI framework | React 19 + Vite 6 |
| Styling | Tailwind CSS 4 |
| Barcode scanning | `@ericblade/quagga2` |
| Font | Inter (Google Fonts) |

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and npm
- **[Ollama](https://ollama.com)** installed and running locally
- A **[Metron.cloud](https://metron.cloud)** account (free registration)

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone <repo-url>
cd "AI Comic Recapper"
```

### 2. Pull the AI models

```bash
ollama pull qwen2.5vl:7b
ollama pull deepseek-r1:14b
```

Make sure Ollama is running (`ollama serve`) before starting the backend.

### 3. Configure the backend

Create `Server/.env`:

```env
METRON_USERNAME=your_metron_username
METRON_PASSWORD=your_metron_password
OLLAMA_LOCAL_HOST=http://127.0.0.1:11434
```

### 4. Start the backend

```bash
cd Server
python -m venv venv
source venv/Scripts/activate   # Windows
# source venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
python main.py
```

The Flask API will start on `http://localhost:5000`.

### 5. Start the frontend

```bash
cd Client/ai-comic-recapper
npm install
npm run dev
```

Open `http://localhost:5173` in your browser, point your camera at a comic book barcode, and scan.

---

## Future Improvements

- **Collection feature** — Save every scanned comic to a personal library so users can browse their reading history and re-read past recaps without rescanning.

- **Caching system** — Store already-generated recaps keyed by UPC so the full AI pipeline is only run once per unique comic. Repeat scans return the cached result instantly, saving GPU time and preventing redundant API calls.

- **Admin remake recap** — An admin-only control to flag and regenerate a recap for a specific issue when the AI output is inaccurate or incomplete, without requiring a full rescan.

- **Cloud AI services** — Replace the local Ollama setup with cloud-hosted AI APIs (e.g., OpenAI GPT-4o for vision, a hosted reasoning model for recaps) to remove the requirement for a high-end local GPU and make the app deployable as a hosted web service.

---

## Attribution

Comic book metadata provided by [Metron.cloud](https://metron.cloud).
