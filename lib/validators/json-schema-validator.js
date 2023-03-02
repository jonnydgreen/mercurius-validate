'use strict'

const Ajv = require('ajv')
const addFormats = require('ajv-formats')
const addErrors = require('ajv-errors')
const { isInputObjectType, isListType } = require('graphql')
const Validator = require('./validator')
const { MER_VALIDATION_ERR_FIELD_TYPE_UNDEFINED } = require('../errors')
const { kAjv, kOpts, kOverrideFieldResolver, kValidationSchema, kBuildArgumentsSchema, kBuildInputTypeFieldSchema } = require('../symbols')
const { getTypeInfo, inferJSONSchemaType } = require('../utils')

class JSONSchemaValidator extends Validator {
  [kValidationSchema] (type, namedType, isNonNull, typeValidation, id) {
    let builtValidationSchema = {
      ...inferJSONSchemaType(namedType, isNonNull),
      $id: id
    }

    // If we have an input type, use references
    if (isInputObjectType(namedType)) {
      if (isListType(type)) {
        const items = { ...builtValidationSchema.items, $ref: `https://mercurius.dev/validation/${namedType.name}` }
        builtValidationSchema = { ...builtValidationSchema, type: 'array', items, nullable: !isNonNull }
      } else {
        builtValidationSchema = {
          ...builtValidationSchema,
          type: 'object',
          $ref: `https://mercurius.dev/validation/${namedType.name}`,
          nullable: !isNonNull
        }
      }
    // If we have an array of scalars, set the array type and infer the items
    } else if (isListType(type)) {
      let items = { ...inferJSONSchemaType(namedType, isNonNull), ...builtValidationSchema.items }
      if (typeValidation !== null) {
        items = { ...items, ...typeValidation.items }
      }
      builtValidationSchema = { ...builtValidationSchema, type: 'array', items, nullable: !isNonNull }
    }

    // Merge with existing validation
    if (typeValidation !== null) {
      builtValidationSchema = { ...typeValidation, ...builtValidationSchema }
    }

    return builtValidationSchema
  }

  [kBuildArgumentsSchema] (typeName, fieldName, schemaTypeField, fieldValidation) {
    // Set up field arguments validation schema
    const fieldArgumentsValidationSchema = {
      $id: `https://mercurius.dev/validation/${typeName}/${fieldName}`,
      type: 'object',
      properties: {}
    }

    for (const argument of schemaTypeField.args) {
      const [argumentType, namedArgumentType, isNonNull] = getTypeInfo(argument)
      const argumentValidation = fieldValidation !== null ? fieldValidation[argument.name] || null : null
      const id = `https://mercurius.dev/validation/${typeName}/${fieldName}/${argument.name}`

      const argumentValidationSchema = this[kValidationSchema](argumentType, namedArgumentType, isNonNull, argumentValidation, id)

      fieldArgumentsValidationSchema.properties[argument.name] = argumentValidationSchema
    }
    this[kOverrideFieldResolver](typeName, schemaTypeField)

    return fieldArgumentsValidationSchema
  }

  [kBuildInputTypeFieldSchema] (typeName, fieldName, schemaTypeField, fieldValidation) {
    const [fieldType, namedFieldType, isNonNull] = getTypeInfo(schemaTypeField)
    const id = `https://mercurius.dev/validation/${typeName}/${fieldName}`

    const builtFieldValidationSchema = this[kValidationSchema](fieldType, namedFieldType, isNonNull, fieldValidation, id)

    // Only consider fields where we have inferred the type to avoid any AJV errors
    if (fieldValidation !== null) {
      if (typeof builtFieldValidationSchema.type === 'undefined') {
        throw new MER_VALIDATION_ERR_FIELD_TYPE_UNDEFINED(builtFieldValidationSchema.$id)
      }
    }

    if (typeof builtFieldValidationSchema.type === 'string' || Array.isArray(builtFieldValidationSchema.type)) {
      return builtFieldValidationSchema
    }
    return null
  }

  registerValidationSchema (schema, validationSchema) {
    // Instantiated here to make sure it is reset after a gateway schema refresh
    this[kAjv] = new Ajv({
      verbose: true,
      allErrors: true,
      coerceTypes: true,
      allowUnionTypes: true,
      ...this[kOpts]
    })
    addFormats(this[kAjv])
    addErrors(this[kAjv], {
      keepErrors: false,
      singleError: true
    })

    // Traverse schema types and override resolvers with validation protection where necessary
    const schemasToRegister = []

    // Process each type within the schema
    for (const [typeName, schemaType] of Object.entries(schema.getTypeMap())) {
      const typeValidation = validationSchema[typeName] || null
      let typeValidationSchema = {
        $id: `https://mercurius.dev/validation/${typeName}`,
        type: 'object',
        nullable: true,
        properties: {}
      }

      // Process each field for the type
      if (!typeName.startsWith('__') && typeof schemaType.getFields === 'function') {
        // Handle any input object type validation
        if (isInputObjectType(schemaType) && typeValidation !== null && typeof typeValidation.__typeValidation !== 'undefined') {
          typeValidationSchema = { ...typeValidation.__typeValidation, ...typeValidationSchema }
        }

        for (const [fieldName, schemaTypeField] of Object.entries(schemaType.getFields())) {
          const fieldValidation = typeValidation !== null ? typeValidation[fieldName] || null : null

          // If the field has arguments, register argument validation
          if (typeof schemaTypeField.args !== 'undefined' && Object.keys(schemaTypeField.args).length > 0) {
            schemasToRegister.push(this[kBuildArgumentsSchema](typeName, fieldName, schemaTypeField, fieldValidation))
            // If the field parent type is an input type, register input object type field validation
          } else if (isInputObjectType(schemaType)) {
            const fieldValidationSchema = this[kBuildInputTypeFieldSchema](typeName, fieldName, schemaTypeField, fieldValidation)
            if (fieldValidationSchema !== null) {
              typeValidationSchema.properties[fieldName] = fieldValidationSchema
            }
          }
        }

        if (isInputObjectType(schemaType)) {
          schemasToRegister.push(typeValidationSchema)
        }
      }
    }

    // Load the schemas into the AJV instance
    for (const schemaToRegister of schemasToRegister) {
      this[kAjv].addSchema(schemaToRegister, schemaToRegister.$id)
    }

    // Force first compilation of each schema definition to improve performance.
    // This must be done in a separate step to guarantee references have been added.
    for (const schemaToRegister of schemasToRegister) {
      this[kAjv].getSchema(schemaToRegister.$id)
    }
  }
}

module.exports = JSONSchemaValidator
