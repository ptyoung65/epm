FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy HTML files and CSS
COPY public/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Fix file permissions to ensure nginx can read all files
RUN chmod -R 644 /usr/share/nginx/html/*.html
RUN chmod 755 /usr/share/nginx/html
RUN mkdir -p /usr/share/nginx/html/css && chmod 755 /usr/share/nginx/html/css

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
