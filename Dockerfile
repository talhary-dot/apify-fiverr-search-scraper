# Builder stage
FROM apify/actor-node:20 AS builder

# Copy configuration files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies including devDependencies
RUN npm --quiet set progress=false \
    && npm install

# Copy source code
COPY src ./src

# Build TypeScript code
RUN npm run build

# Production stage
FROM apify/actor-node:20

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional

# Copy compiled code from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY .actor ./.actor

# Run the compiled code
CMD ["npm", "run", "start:prod"]
