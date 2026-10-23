export function buildCaptureBookmarklet(appOrigin: string): string {
  let endpoint: string;
  try {
    const origin = new URL(appOrigin);
    if ((origin.protocol !== 'http:' && origin.protocol !== 'https:') || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
      throw new Error('Only HTTP or HTTPS app origins are allowed');
    }
    endpoint = new URL('/capture', origin.origin).toString();
  } catch (error) {
    if (error instanceof Error && error.message.includes('HTTP or HTTPS')) throw error;
    throw new Error('Only HTTP or HTTPS app origins are allowed');
  }
  return `javascript:(()=>{const p=new URLSearchParams({url:location.href,title:document.title,text:(window.getSelection()?.toString()??"").slice(0,20000)});window.open(${JSON.stringify(endpoint)}+"?"+p.toString(),"_blank","noopener,noreferrer")})()`;
}
