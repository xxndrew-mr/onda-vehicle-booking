import { Html, Head, Main, NextScript } from 'next/document';

// Skrip anti-flash: set data-theme SEBELUM paint (dari localStorage, fallback ke
// preferensi sistem) agar tidak ada kedipan tema saat reload. Harus inline &
// sinkron di <head>.
const noFlashTheme = `(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function Document() {
  return (
    <Html lang="id">
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
