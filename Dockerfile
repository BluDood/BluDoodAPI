FROM node:lts-alpine

WORKDIR /app

# copy package.json
COPY package.json package-lock.json ./

# install dependencies
RUN npm ci

# copy source code
COPY . /app

# build server
RUN npm run build

# start
CMD npm start