import type { Metadata } from "next";
import { MarketingHomePage } from "@/components/home/marketing-home";
import { SignedInHomeRedirect } from "@/components/home/signed-in-home-redirect";
import {
  BRAND,
  BRAND_SIZE,
  OG_IMAGE_ALT,
  SITE_DESCRIPTION,
  SITE_TITLE,
} from "@/lib/brand/assets";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: BRAND.ogImage,
        width: BRAND_SIZE.ogImage.width,
        height: BRAND_SIZE.ogImage.height,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: BRAND.ogImage,
        width: BRAND_SIZE.ogImage.width,
        height: BRAND_SIZE.ogImage.height,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
};

export default function PublicHomePage() {
  return (
    <>
      <SignedInHomeRedirect />
      <MarketingHomePage />
    </>
  );
}
