import { Readable } from 'stream';

//deprecated, no longer using it
//Convert buffer to readable stream
export function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null); //Signal end of the stream
  return stream;
}