import Script from 'next/script';
import { env } from '@/shared/config/env';
import { PostHogInit } from './posthog';

/** Third-party analytics, production only and each switched off when its id is not configured. */
export function Analytics() {
  if (!env.isProduction) return null;
  return (
    <>
      {env.gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${env.gaId}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${env.gaId}');`}
          </Script>
        </>
      )}
      {env.clarityId && (
        <Script id="clarity-init" strategy="lazyOnload">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${env.clarityId}");`}
        </Script>
      )}
      {env.posthog.token && <PostHogInit token={env.posthog.token} host={env.posthog.host} />}
    </>
  );
}
