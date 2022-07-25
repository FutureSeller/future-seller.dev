import * as React from 'react'
import { graphql, PageProps } from 'gatsby'

const IndexPage = ({ data }: PageProps<Queries.IndexPageQuery>) => {
  return (
    <main>
      <title>{data.site?.siteMetadata?.title}</title>
      <h1>
        {data.site?.siteMetadata?.title}
        <br />
        <span>— you just made a Gatsby site! </span>
        🎉🎉🎉
      </h1>
    </main>
  )
}

export default IndexPage

export const pageQuery = graphql`
  query IndexPage {
    site {
      siteMetadata {
        title
      }
    }
  }
`
