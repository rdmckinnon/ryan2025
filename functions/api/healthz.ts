/**
 * Health check endpoint for uptime monitoring
 * Returns 200 OK with minimal overhead
 */

export const onRequest: PagesFunction = async () => {
  return new Response('OK', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache'
    }
  });
};
