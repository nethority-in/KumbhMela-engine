FROM python:3.12-slim

WORKDIR /app

COPY engine/requirements.txt /app/engine/requirements.txt
RUN pip install --no-cache-dir -r /app/engine/requirements.txt

COPY . /app

WORKDIR /app
CMD ["sh", "-c", "python engine/panchang_engine.py && python crowd-model/score.py"]