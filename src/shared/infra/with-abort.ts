export async function withAbort<T>(signal: AbortSignal | undefined, promise: Promise<T>): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) throw new Error('REQUEST_ABORTED');

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error('REQUEST_ABORTED'));
    signal.addEventListener('abort', onAbort, { once: true });

    promise
      .then((value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      })
      .catch((error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      });
  });
}
