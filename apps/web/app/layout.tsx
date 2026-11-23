import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEPATRONIX SMS",
  description: "School management for institutes, attendance, and transport",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css?family=Poppins:300,400,500,600,700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/fontawesome/css/all.css" />
        <link rel="stylesheet" href="/fontawesome/css/sharp-solid.css" />
        <link rel="stylesheet" href="/fontawesome/css/sharp-regular.css" />
        <link rel="stylesheet" href="/fontawesome/css/sharp-light.css" />
        <link rel="stylesheet" href="https://eskooly.com/bb/assets/icon/themify-icons/themify-icons.css" />
        <link rel="stylesheet" href="https://eskooly.com/bb/assets/icon/font-awesome/css/font-awesome.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
