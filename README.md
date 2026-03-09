# 🛡️ The Freshness Guard

**A manual food waste reduction app. No AI. No predictions. Just fresh food.**

Track your fridge, reduce waste, and save money — powered by 100% user-inputted data and hard-coded logic.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📷 **Barcode Scanner** | Scan products with QuaggaJS + Open Food Facts lookup |
| ⚡ **3-Second Add** | Quick-add buttons (+3, +7, +14 days) or date picker |
| 🎨 **Color-Coded Dashboard** | Red (expired), Orange (<48h), Yellow (<7d), Green (safe) |
| 🔔 **Smart Notifications** | Hard-coded alerts at 72h, 24h, and 1h before expiry |
| 👨‍👩‍👧‍👦 **Family Sync** | Share a fridge list across devices with invite codes |
| 📊 **Waste History** | Track what was used vs. wasted, see money lost |
| 🛒 **Shopping List** | Auto-generated from items you've used (premium) |
| 💚 **Donation Map** | Find nearby food banks for items expiring soon |

---

## 🚀 Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
python app.py
```

Open **http://127.0.0.1:5000** in your browser.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3 + Flask |
| Database | SQLite via SQLAlchemy |
| Frontend | HTML / CSS / Vanilla JS |
| Barcode | QuaggaJS (browser-side) |
| Product DB | Open Food Facts API |

---

## 📁 Project Structure

```
├── app.py              # Flask app factory
├── models.py           # SQLAlchemy ORM models
├── routes.py           # REST API endpoints
├── notifications.py    # Notification trigger engine
├── requirements.txt    # Python dependencies
└── static/
    ├── index.html      # Single-page frontend
    ├── css/
    │   └── style.css   # Dark theme design system
    └── js/
        └── app.js      # Client-side application logic
```

---

## 🎯 Core Philosophy

> **No AI. No predictive algorithms. No "smart" guessing.**
> 
> Every date, every name, every action is user-provided or hard-coded.
> Reliability and speed over complexity.

---

## 📝 License

MIT
