import React from 'react'
import { Link } from 'gatsby'

interface Props {
  children: React.ReactNode
}

const Layout = ({ children }: Props) => {
  return (
    <div className="flex flex-col min-w-xl max-w-2xl px-4 mx-auto h-full">
      <header>
        <div className="py-10 flex justify-between items-center">
          <Link to="/">
            <span className="text-4xl font-bold">FS.dev</span>
          </Link>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="py-8">
        © {new Date().getFullYear()} FutureSeller. All rights reserved.
      </footer>
    </div>
  )
}

export default Layout