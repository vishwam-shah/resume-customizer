/**
 * Sets data-theme on <html> before first paint, so there is no flash of the
 * wrong theme. Runs inline in <head>; must stay tiny and dependency-free.
 */
const script = `(()=>{try{
var s=localStorage.getItem("theme");
var m=window.matchMedia("(prefers-color-scheme: dark)");
var apply=function(){var d=s==="dark"||(s!=="light"&&m.matches);document.documentElement.dataset.theme=d?"dark":"light";};
apply();
if(s!=="light"&&s!=="dark")m.addEventListener("change",apply);
}catch(e){}})()`;

export function ThemeScript() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party script required before hydration
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
