import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import Sprite from "@/components/Sprite";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return <><Sprite /><Nav />{children}<Footer /></>;
}
