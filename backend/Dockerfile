FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads/images

# Railway/Render set PORT env var automatically
ENV API_HOST=0.0.0.0
ENV PORT=8000

EXPOSE 8000

CMD ["python", "run.py"]
