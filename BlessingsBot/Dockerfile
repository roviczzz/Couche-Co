FROM n8nio/n8n:latest

USER root

# Install system dependencies for Python packages
RUN apk add --no-cache python3 py3-pip build-base jpeg-dev zlib-dev libjpeg npm \
  && ln -sf /usr/bin/python3 /usr/bin/python

# Create and activate virtual environment; install Python packages
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --upgrade pip \
  && /opt/venv/bin/pip install pyimgbox Pillow

# Install npm packages globally
RUN npm install -g imgbox

# Add venv bin to PATH so Python node can access packages
ENV PATH="/opt/venv/bin:$PATH"

USER node
