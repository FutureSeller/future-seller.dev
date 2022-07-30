import type { GatsbyConfig } from 'gatsby'

const config: GatsbyConfig = {
  siteMetadata: {
    description: 'FutureSeller의 개발 관련 경험 및 이야기들',
    siteUrl: `https://future-seller.dev`,
    title: `FutureSeller의 개발 블로그`,
  },
  // More easily incorporate content into your pages through automatic TypeScript type generation and better GraphQL IntelliSense.
  // If you use VSCode you can also use the GraphQL plugin
  // Learn more at: https://gatsby.dev/graphql-typegen
  graphqlTypegen: {
    typesOutputPath: `gatsby-types.d.ts`,
  },
  plugins: [
    {
      resolve: 'gatsby-plugin-google-analytics',
      options: {
        trackingId: 'UA-177372093-1',
      },
    },
    'gatsby-plugin-image',
    'gatsby-plugin-react-helmet',
    'gatsby-plugin-sitemap',
    'gatsby-plugin-sharp',
    'gatsby-transformer-sharp',
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'posts',
        path: `${__dirname}/content/posts/`,
      },
    },
    'gatsby-transformer-gitinfo',
    {
      resolve: 'gatsby-transformer-remark',
      options: {
        plugins: [
          {
            resolve: 'gatsby-remark-images',
            options: {
              maxWidth: 960,
            },
          },
          {
            resolve: `gatsby-remark-responsive-iframe`,
            options: {
              wrapperStyle: `margin-bottom: 1.0725rem`,
            },
          },
          `gatsby-remark-vscode`,
          `gatsby-remark-copy-linked-files`,
          'gatsby-remark-autolink-headers',
          `gatsby-remark-external-links`,
          {
            resolve: 'gatsby-plugin-sitemap',
            options: {
              query: `
              {
                site {
                  siteMetadata {
                    siteUrl
                  } 
                }
                allSitePage(
                  filter: {
                    path: { regex: "/^(?!/404/|/404.html|/dev-404-page/)/" }
                  }
                ) {
                  nodes {
                    path
                  }
                }
                allFile(filter: {sourceInstanceName: {eq: "posts"}, relativePath: {regex: "/index.md$/"}}) {
                  edges {
                    node {
                      fields {
                        gitLogLatestDate
                        slug
                      }
                    }
                  }
                }
              }
            `,
              resolvePages: ({
                allSitePage: { nodes: allPages },
                allFile: { edges: pageFiles },
              }: Queries.Query) => {
                return allPages.map(page => {
                  const pageFile = pageFiles.find(({ node }) =>
                    page.path.includes(node.fields!.slug!)
                  )
                  return {
                    ...page,
                    ...pageFile?.node.fields,
                  }
                })
              },
              serialize: ({ path, gitLogLatestDate }: Queries.SitePage & Queries.FileFields) => {
                return {
                  url: path,
                  lastmod: gitLogLatestDate,
                }
              },
            },
          },
        ],
      },
    },
  ],
}

export default config
