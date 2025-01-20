import { Readable } from 'stream';

//Convert buffer to readable stream
export function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null); //Signal end of the stream
  return stream;
}