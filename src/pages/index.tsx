import React from 'react'
import { graphql } from 'gatsby'
import type { PageProps } from 'gatsby'

import SEO from '../components/SEO'
import Layout from '../components/Layout'
import Post from '../components/Post'

const IndexPage = ({ data }: PageProps<Queries.IndexPageQuery>) => {
  return (
    <main>
      <SEO
        description={data.site?.siteMetadata.description}
        title={data.site?.siteMetadata.title || 'FS.dev'}
      />
      <Layout>
        <h1 className="sr-only">{data.site?.siteMetadata.description}</h1>
        {data.allMarkdownRemark.edges.map(edge => (
          <Post key={edge.node.fields.slug} node={edge.node} />
        ))}
      </Layout>
    </main>
  )
}

export default IndexPage

export const pageQuery = graphql`
  query IndexPage {
    site {
      siteMetadata {
        description
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
