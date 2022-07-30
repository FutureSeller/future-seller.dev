import type { GatsbyNode } from 'gatsby'
import { createFilePath } from 'gatsby-source-filesystem'
import { resolve } from 'path'

export const createSchemaCustomization: GatsbyNode['createSchemaCustomization'] = ({ actions }) => {
  actions.createTypes(`
    type Site {
      siteMetadata: SiteMetadata!
    }

    type SiteMetadata {
      description: String!
      siteUrl: String!
      title: String!
    }

    type MarkdownRemarkFrontmatter {
      category: String!
      date: Date!
      description: String!
      draft: Boolean!
      layout: String!
      title: String!
    }
    
    type MarkdownRemarkFields {
      slug: String!
    }

    type MarkdownRemark implements Node {
      frontmatter: MarkdownRemarkFrontmatter!
      fields: MarkdownRemarkFields!
    }
  `)
}

export const onCreateNode: GatsbyNode['onCreateNode'] = ({ node, actions, getNode }) => {
  const { createNodeField } = actions

  if (node.internal.type === 'MarkdownRemark') {
    if (!node.parent) {
      throw new Error('[UNREACHABLE]: MarkdownRemark does not have a parent node.')
    }

    const fileNode = getNode(node.parent)
    if (!fileNode) {
      throw new Error('[UNREACHABLE]: A parent node does not exists.')
    }

    const parsedFilePath = createFilePath({ node: fileNode, getNode, basePath: 'posts' })
    const slug = `${parsedFilePath.split('---')[1].replace(/\/$/, '')}`
    createNodeField({
      node,
      name: 'slug',
      value: slug,
    })
  } else if (node.internal.type === 'File') {
    const parsedFilePath = createFilePath({ node, getNode, basePath: 'posts' })
    const slug = `${parsedFilePath.split('---')[1].replace(/\/$/, '')}`
    createNodeField({
      node,
      name: 'slug',
      value: slug,
    })
  }
}

export const createPages: GatsbyNode['createPages'] = async ({ actions, graphql }) => {
  const { createPage } = actions

  const allMarkdown = await graphql<{ allMarkdownRemark: Queries.MarkdownRemarkConnection }>(`
    {
      allMarkdownRemark(limit: 1000, filter: { frontmatter: { draft: { ne: true } } }) {
        edges {
          node {
            fields {
              slug
            }
            frontmatter {
              category
              layout
            }
          }
        }
      }
    }
  `)

  if (allMarkdown.errors) {
    console.error(allMarkdown.errors)
    throw allMarkdown.errors
  }

  allMarkdown.data?.allMarkdownRemark.edges.forEach(edge => {
    if (edge.node.frontmatter?.layout === 'post') {
      if (!edge.node.fields || !edge.node.fields.slug) {
        return
      }

      const slug = edge.node.fields.slug
      createPage({
        path: `/posts/${slug}`,
        component: resolve('./src/templates/post-template.tsx'),
        context: { slug },
      })
    }
  })
}
