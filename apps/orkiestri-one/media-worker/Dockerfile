FROM debian:bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git cmake g++ make curl && rm -rf /var/lib/apt/lists/*
WORKDIR /source
RUN git init && git remote add origin https://github.com/ggml-org/whisper.cpp.git \
 && git fetch --depth 1 origin 231638a0717b7822784297e5980965ffcec05810 \
 && git checkout --detach FETCH_HEAD \
 && test "$(git rev-parse HEAD)" = 231638a0717b7822784297e5980965ffcec05810 \
 && cmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF \
 && cmake --build build --target whisper-cli -j1
RUN mkdir /models && curl --fail --location --retry 3 https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin -o /models/ggml-base.bin \
 && echo '465707469ff3a37a2b9b8d8f89f2f99de7299dac  /models/ggml-base.bin' | sha1sum -c -

FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg espeak-ng libgomp1 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /source/build/bin/whisper-cli /usr/local/bin/whisper-cli
COPY --from=builder /models /models
WORKDIR /worker
COPY server.cjs ./server.cjs
USER node
EXPOSE 8081
CMD ["node","--max-old-space-size=64","server.cjs"]
