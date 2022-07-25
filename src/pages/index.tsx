import React from 'react'
import Helmet from 'react-helmet'
import { graphql } from 'gatsby'
import type { PageProps } from 'gatsby'

import Layout from '../components/Layout'
import Post from '../components/Post'

const IndexPage = ({ data }: PageProps<Queries.IndexPageQuery>) => {
  const posts = data.allMarkdownRemark.edges.map(edge => (
    <Post key={edge.node.fields.slug} node={edge.node} />
  ))

  return (
    <main>
      <Helmet>
        <title>{data.site?.siteMetadata.title}</title>
        <meta name="description" />
      </Helmet>
      <Layout>
        <h1 className="sr-only">you just made a Gatsby site!</h1>
        {posts}
      </Layout>
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
