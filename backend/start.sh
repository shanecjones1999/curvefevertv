#!/bin/bash

echo "Starting CurveFever Party Backend..."
echo "Installing dependencies..."
pip install -r requirements.txt

echo "Starting FastAPI server on port 8000..."
python main.py
