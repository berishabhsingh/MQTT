# Use an official Node runtime as a parent image
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Copy package definition and install dependencies
COPY package.json .
COPY package-lock.json* .

RUN npm install --omit=dev

# Copy the rest of the application
COPY . .

# Build Prisma client and Next.js application
RUN npx prisma generate && npm run build

# Expose port
EXPOSE 3000

# Run migrations at start time and launch the server
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]