#!/bin/bash
set -e

echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "Error: docker is not installed."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "Warning: jq is not installed. Some scripts might require it."
fi

if [ ! -f .env ]; then
    echo "Error: .env file not found. Please copy .env.example to .env"
    exit 1
fi

echo "Environment looks good."
