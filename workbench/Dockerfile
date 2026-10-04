FROM node:22-bookworm-slim AS assets
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY resources ./resources
COPY app ./app
COPY public/assets ./public/assets
COPY tailwind.config.cjs vite.config.js ./
RUN npm run build

FROM php:8.4-fpm-bookworm
WORKDIR /var/www/html
RUN apt-get update && apt-get install -y --no-install-recommends libonig-dev libpq-dev libsqlite3-dev libzip-dev libpng-dev unzip git \
 && docker-php-ext-install mbstring pdo_pgsql pdo_sqlite pcntl zip gd bcmath \
 && pecl install redis && docker-php-ext-enable redis \
 && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts
COPY . .
COPY --from=assets /build/public/css /var/www/html/public/css
RUN mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
 && composer dump-autoload --no-dev --optimize --no-scripts \
 && BROADCAST_CONNECTION=null php artisan package:discover \
 && composer check-platform-reqs --no-dev \
 && ln -s /var/www/html/storage/app/public public/storage \
 && chown -R www-data:www-data storage bootstrap/cache
USER www-data
CMD ["php-fpm", "-F"]
