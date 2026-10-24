import './globals.css';
export const metadata = {title:'AI Engineering | Progress Tracker',description:'Build your own AI engineering checklist, priorities and learning focus.'};
export default function RootLayout({children}) {
  // Browser extensions can add attributes to <html> before React hydrates.
  // Limit suppression to this element; descendant hydration checks remain active.
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
