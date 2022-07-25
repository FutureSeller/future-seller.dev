import React from 'react'
import { graphql, Link } from 'gatsby'
import type { PageProps } from 'gatsby'

const IndexPage = ({ data }: PageProps<Queries.IndexPageQuery>) => {
  return (
    <main>
      <title>{data.site?.siteMetadata?.title}</title>
      <h1>
        {data.site?.siteMetadata?.title}
        <br />
        <span>— you just made a Gatsby site! </span>
        <ul>
          {data.allMarkdownRemark.edges.map(edge => {
            return (
              <li>
                <Link to={`/posts/${edge.node.fields?.slug!}`}>{edge.node.frontmatter?.title}</Link>
              </li>
            )
          })}
        </ul>
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
    allMarkdownRemark(sort: { order: DESC, fields: [frontmatter___date] }) {
      edges {
        node {
          fields {
            slug
          }
          frontmatter {
            date
            description
            title
          }
        }
      }
    }
  }
`
