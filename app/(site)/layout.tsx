import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import Sprite from "@/components/Sprite";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <><Sprite /><Nav />{children}<Footer /></>;
}
