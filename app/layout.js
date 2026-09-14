import "./globals.css";

export const metadata = {
  title: "BoloMasti — Meet. Talk. Masti.",
  description: "A kinder way to meet new people, one real conversation at a time.",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
