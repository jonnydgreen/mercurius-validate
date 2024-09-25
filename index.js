'use strict'

const fp = require('fastify-plugin')
const Validation = require('./lib/validation')
const { validateOpts } = require('./lib/utils')
const { validationDirective, validationTypeDefs } = require('./lib/directive')

const mercuriusValidation = fp(
  async function (app, opts) {
    // Validate options
    const validatedOpts = validateOpts(opts)

    // Start validation and register hooks
    const validation = new Validation(app, validatedOpts)

    validation.registerValidationSchema(app.graphql.schema)

    // Add hook to regenerate the resolvers when the schema is refreshed
    if (app.graphqlGateway) {
      app.graphqlGateway.addHook('onGatewayReplaceSchema', async (instance, schema) => {
        validation.registerValidationSchema(schema)
      })
    }
  },
  {
    name: 'mercurius-validation',
    fastify: '5.x',
    dependencies: ['mercurius']
  }
)

mercuriusValidation.graphQLDirective = validationDirective
mercuriusValidation.graphQLTypeDefs = validationTypeDefs

module.exports = mercuriusValidation
