#!/bin/bash
sudo rm -f /etc/nginx/sites-enabled/default
cat << 'EOF' | sudo tee /etc/nginx/sites-available/minddreams.in
server {
    listen 80;
    server_name minddreams.in www.minddreams.in;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/minddreams.in /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d minddreams.in -d www.minddreams.in --non-interactive --agree-tos -m admin@minddreams.in
