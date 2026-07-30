import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "../../../internal-auth";

type Lead = {
  id: string;
  website?: string;
  phone?: string;
  email?: string;
  contactSource?: string;
};

function safeWebsite(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) return null;
    return url;
  } catch {
    return null;
  }
}

function cleanHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/&commat;|&#64;|&#x40;/gi, "@")
    .replace(/&#(?:x27|39);/gi, "'")
    .replace(/\s+/g, " ");
}

function findContacts(html: string) {
  const text = cleanHtml(html);
  const mailto = Array.from(text.matchAll(/mailto:([^"'?\s>]+)/gi), (match) => match[1]);
  const visible = Array.from(
    text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
    (match) => match[0],
  );
  const email = [...mailto, ...visible].find(
    (value) => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(value),
  );
  const tel = text.match(/tel:([^"'?\s>]+)/i)?.[1];
  const visiblePhone = text.match(
    /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]\d{4,6}/,
  )?.[0];
  return {
    email: email ? decodeURIComponent(email).toLowerCase() : undefined,
    phone: tel ? decodeURIComponent(tel) : visiblePhone,
  };
}

async function fetchPage(url: URL) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "MapMint-by-Nivaro/1.0 (+https://mapmint-by-nivaro.vercel.app)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) return "";
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return "";
  return (await response.text()).slice(0, 750_000);
}

async function enrichLead(lead: Lead) {
  const website = safeWebsite(lead.website);
  if (!website) return lead;
  try {
    const homeHtml = await fetchPage(website);
    let contacts = findContacts(homeHtml);

    if (!contacts.email || !contacts.phone) {
      const contactHref = homeHtml.match(
        /href=["']([^"']*(?:contact|about|reach-us|get-in-touch)[^"']*)["']/i,
      )?.[1];
      if (contactHref) {
        const contactUrl = safeWebsite(new URL(contactHref, website).toString());
        if (contactUrl && contactUrl.origin === website.origin) {
          const contactContacts = findContacts(await fetchPage(contactUrl));
          contacts = {
            email: contacts.email || contactContacts.email,
            phone: contacts.phone || contactContacts.phone,
          };
        }
      }
    }

    return {
      ...lead,
      website: website.toString(),
      email: lead.email || contacts.email,
      phone: lead.phone || contacts.phone,
      contactSource:
        contacts.email || contacts.phone
          ? website.toString()
          : lead.contactSource,
    };
  } catch {
    return { ...lead, website: website.toString() };
  }
}

export async function POST(request: NextRequest) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  const body = await request.json();
  const leads = (Array.isArray(body.leads) ? body.leads : []).slice(0, 20) as Lead[];
  const enriched = await Promise.all(leads.map(enrichLead));
  return NextResponse.json({ leads: enriched });
}
