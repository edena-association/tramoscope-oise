FROM python:3.11-slim

# Dépendances système pour GeoPandas, Rasterio, WeasyPrint
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin libgdal-dev \
    libpango-1.0-0 libpangoft2-1.0-0 \
    libcairo2 libffi-dev shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

ENV BACKEND_HOST=0.0.0.0
ENV BACKEND_PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host ${BACKEND_HOST} --port ${BACKEND_PORT}"]
