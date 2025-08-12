FROM n8nio/n8n:latest

USER root

# Install your needed packages here, e.g. npm, pyimgbox dependencies, etc.
RUN apk add --no-cache npm python3 py3-pip build-base jpeg-dev zlib-dev libjpeg \
  && pip3 install pyimgbox Pillow \
  && npm install -g imgbox \
  && ln -sf /usr/bin/python3 /usr/bin/python

USER node
