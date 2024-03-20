# mercurius-validation

- [Plugin options](#plugin-options)

## Plugin options

**mercurius-validation** supports the following options:

Extends: [`AJVOptions`](https://ajv.js.org/options.html)

* **mode** `"JSONSchema" | "JTD"` (optional, default: `"JSONSchema"`) - the validation mode of the plugin. This is used to specify the type of schema that needs to be compiled.
* **schema** `MercuriusValidationSchema` (optional) - the validation schema definition that the plugin with run. One can define JSON Schema or JTD definitions for GraphQL types, fields and arguments or functions for GraphQL arguments.
* **directiveValidation** `boolean` (optional, default: `true`) - turn directive validation on or off. It is on by default.
* **customTypeInferenceFn** `Function` (optional) - add custom type inference for JSON Schema Types. This function overrides the default type inference logic which infers GraphQL primitives like `GraphQLString`, `GraphQLInt` and `GraphQLFloat`. If the custom function doesn't handle the passed type, then it should return a falsy value which will trigger the default type inference logic of the plugin. This function takes two parameters. The first parameter is `type` referring to the GraphQL type under inference, while the second one is `isNonNull`, a boolean value referring whether the value for the type is nullable.

It extends the [AJV options](https://ajv.js.org/options.html). These can be used to register additional `formats` for example and provide further customization to the AJV validation behavior.

### Parameter: `MercuriusValidationSchema`

Extends: `Record<string, MercuriusValidationSchemaType>`

Each key within the `MercuriusValidationSchema` type corresponds with the  GraphQL type name. For example, if we wanted validation on input type:

```gql
input Filters {
  ...
}
```

We would use the key: `Filters`:

```js
{
  Filters: { ... }
}
```

### Parameter: `MercuriusValidationSchemaType`

Extends: `Record<string, MercuriusValidationSchemaField>`

* **__typeValidation** `JSONSchema | JTD` (optional) - The [JSON Schema](https://json-schema.org/understanding-json-schema/) or [JTD](https://jsontypedef.com/docs/) schema definitions for the type. This is only applicable to GraphQL Input object types, so only schema definitions for `object` are applicable here.

Each key within the `MercuriusValidationSchemaType` type corresponds with the GraphQL field name on a type. For example, if we wanted validation on type field `text`:

```gql
input Filters {
  id: ID
  text: String
}
```

We would use the key: `text`:

```js
{
  Filters: {
    text: { ... }
  }
}
```

### Parameter: `MercuriusValidationSchemaField`

The field definition is different for GraphQL Input Object types and GraphQL Object types.

#### GraphQL Input Object Types

Union: `JSONSchema | JTD`

#### GraphQL Object Types

Extends: `Record<string, MercuriusValidationSchemaArgument>`

Each key within the `MercuriusValidationSchemaField` type corresponds with the GraphQL argument name on a field. For example, if we wanted validation on field argument `id`:

```gql
type Query {
  message(id: ID): String
}
```

We would use the key: `id`:

```js
{
  Query: {
    message: {
      id: {... }
    }
  }
}
```

### Parameter: `MercuriusValidationSchemaArgument`

Union: `JSONSchema | JTD` | `MercuriusValidationFunction`

### Parameter: `MercuriusValidationFunction(metadata, value, parent, arguments, context, info)`

Arguments:

* **metadata** `MercuriusValidationFunctionMetadata` - the GraphQL argument metadata associated with the function definition. 
* **value** `any` - the value of the argument.
* **parent** `object` - the parent data associated with the GraphQL field.
* **arguments** `object` - the key value object of the GraphQL field arguments.
* **context** `MercuriusContext` - the [Mercurius context](https://mercurius.dev/#/docs/context).
* **info** `GraphQLResolveInfo` - the [GraphQL Resolve info](https://graphql.org/graphql-js/type/#graphqlobjecttype) of the object type.

#### Parameter: `MercuriusValidationFunctionMetadata`

* **type** `string` - the name of the associated GraphQL type.
* **field** `string` - the name of the associated GraphQL field.
* **argument** `string` - the name of the associated GraphQL argument.

Returns: `void`

### Parameter: `JSONSchema`

The [JSON Schema](https://json-schema.org/understanding-json-schema/) schema definition for the input object type, type field or field argument.

### Parameter: `JTD`

The [JTD](https://jsontypedef.com/docs/) schema definition for the input object type, type field or field argument.
