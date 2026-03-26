#!/bin/bash
pip install -q mkdocs-material 2>/dev/null
python3 -m mkdocs serve -a 0.0.0.0:8000
