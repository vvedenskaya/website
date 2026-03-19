FROM nginx:1.27-alpine

# Copy the static website into Nginx web root.
COPY . /usr/share/nginx/html

EXPOSE 80

