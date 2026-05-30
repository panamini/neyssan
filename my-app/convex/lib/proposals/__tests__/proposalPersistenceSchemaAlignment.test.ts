import { readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

function getPropertyName(name: ts.PropertyName): string {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  throw new Error(`Unsupported property name kind: ${ts.SyntaxKind[name.kind]}`);
}

function getPropertyAssignment(
  objectLiteral: ts.ObjectLiteralExpression,
  propertyName: string,
): ts.PropertyAssignment {
  const property = objectLiteral.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) &&
      getPropertyName(candidate.name) === propertyName,
  );

  if (!property) {
    throw new Error(`Missing property "${propertyName}".`);
  }

  return property;
}

function getObjectLiteralFromCallChain(
  callExpression: ts.CallExpression,
): ts.ObjectLiteralExpression {
  const [firstArg] = callExpression.arguments;
  if (firstArg && ts.isObjectLiteralExpression(firstArg)) {
    return firstArg;
  }

  if (
    ts.isPropertyAccessExpression(callExpression.expression) &&
    ts.isCallExpression(callExpression.expression.expression)
  ) {
    return getObjectLiteralFromCallChain(callExpression.expression.expression);
  }

  throw new Error("Expected call expression chain to receive an object literal.");
}

function getNestedObjectLiteralFromValidatorCall(
  expression: ts.Expression,
): ts.ObjectLiteralExpression {
  if (ts.isObjectLiteralExpression(expression)) {
    return expression;
  }
  if (!ts.isCallExpression(expression)) {
    throw new Error("Expected nested validator expression to be a call expression.");
  }

  const [firstArg] = expression.arguments;
  if (!firstArg) {
    throw new Error("Expected nested validator call to receive an argument.");
  }

  if (ts.isObjectLiteralExpression(firstArg)) {
    return firstArg;
  }
  if (ts.isCallExpression(firstArg)) {
    return getNestedObjectLiteralFromValidatorCall(firstArg);
  }

  throw new Error("Expected nested validator call to contain an object literal.");
}

function getMetadataFieldNamesFromValidator(
  validatorExpression: ts.Expression,
): string[] {
  if (!ts.isCallExpression(validatorExpression)) {
    throw new Error("Expected metadata validator to be a call expression.");
  }

  const validatorObject = getNestedObjectLiteralFromValidatorCall(
    validatorExpression,
  );
  return validatorObject.properties
    .filter(ts.isPropertyAssignment)
    .map((property) => getPropertyName(property.name));
}

function parseSourceFile(filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function getStoreProposalMetadataFields(filePath: string): string[] {
  const sourceFile = parseSourceFile(filePath);

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== "storeProposal" ||
        !declaration.initializer ||
        !ts.isCallExpression(declaration.initializer)
      ) {
        continue;
      }

      const mutationConfig = getObjectLiteralFromCallChain(declaration.initializer);
      const argsProperty = getPropertyAssignment(mutationConfig, "args");
      if (!ts.isObjectLiteralExpression(argsProperty.initializer)) {
        throw new Error("Expected storeProposal args to be an object literal.");
      }

      const metadataProperty = getPropertyAssignment(
        argsProperty.initializer,
        "metadata",
      );
      return getMetadataFieldNamesFromValidator(metadataProperty.initializer);
    }
  }

  throw new Error("Unable to locate storeProposal args metadata validator.");
}

function getDefaultMutationMetadataFields(filePath: string): string[] {
  const sourceFile = parseSourceFile(filePath);

  for (const statement of sourceFile.statements) {
    if (!ts.isExportAssignment(statement)) continue;
    if (!ts.isCallExpression(statement.expression)) continue;

    const mutationConfig = getObjectLiteralFromCallChain(statement.expression);
    const argsProperty = getPropertyAssignment(mutationConfig, "args");
    if (!ts.isObjectLiteralExpression(argsProperty.initializer)) {
      throw new Error("Expected default mutation args to be an object literal.");
    }

    const metadataProperty = getPropertyAssignment(
      argsProperty.initializer,
      "metadata",
    );
    return getMetadataFieldNamesFromValidator(metadataProperty.initializer);
  }

  throw new Error("Unable to locate default mutation args metadata validator.");
}

function getProposalSchemaMetadataFields(filePath: string): string[] {
  const sourceFile = parseSourceFile(filePath);

  for (const statement of sourceFile.statements) {
    if (!ts.isExportAssignment(statement)) continue;
    if (!ts.isCallExpression(statement.expression)) continue;

    const schemaConfig = getObjectLiteralFromCallChain(statement.expression);
    const proposalsProperty = getPropertyAssignment(schemaConfig, "proposals");
    if (!ts.isCallExpression(proposalsProperty.initializer)) {
      throw new Error("Expected proposals table to be defined via defineTable.");
    }

    const proposalsTable = getObjectLiteralFromCallChain(
      proposalsProperty.initializer,
    );
    const metadataProperty = getPropertyAssignment(proposalsTable, "metadata");
    return getMetadataFieldNamesFromValidator(metadataProperty.initializer);
  }

  throw new Error("Unable to locate proposals.metadata schema validator.");
}

function getProposalsPublicReturnMetadataFields(filePath: string): string[] {
  const sourceFile = parseSourceFile(filePath);

  for (const statement of sourceFile.statements) {
    if (!ts.isExportAssignment(statement)) continue;
    if (!ts.isCallExpression(statement.expression)) continue;

    const queryConfig = getObjectLiteralFromCallChain(statement.expression);
    const returnsProperty = getPropertyAssignment(queryConfig, "returns");
    if (!ts.isCallExpression(returnsProperty.initializer)) {
      throw new Error("Expected proposalsPublic returns validator to be a call expression.");
    }

    const returnsArrayObject = getNestedObjectLiteralFromValidatorCall(
      returnsProperty.initializer,
    );
    const metadataProperty = getPropertyAssignment(returnsArrayObject, "metadata");
    return getMetadataFieldNamesFromValidator(metadataProperty.initializer);
  }

  throw new Error(
    "Unable to locate proposalsPublic returns metadata validator.",
  );
}

describe("proposal persistence schema alignment", () => {
  const proposalHeadingMetadataFields = [
    "applicantName",
    "applicantRole",
    "applicantCompany",
    "contactLine",
    "letterDate",
    "recipientDetails",
    "headerShowSender",
    "headerShowDate",
    "headerShowSubject",
    "headerShowRecipient",
    "headerShowRecipientDetails",
  ];

  it("keeps storeProposal metadata fields aligned with the proposals table schema and public query return shape", () => {
    const proposalsFile = path.resolve(process.cwd(), "convex/proposals.ts");
    const schemaFile = path.resolve(process.cwd(), "convex/schema.ts");
    const proposalsPublicFile = path.resolve(
      process.cwd(),
      "convex/proposalsPublic.ts",
    );
    const storeProposalFields = getStoreProposalMetadataFields(proposalsFile);
    const schemaFields = getProposalSchemaMetadataFields(schemaFile);
    const publicReturnFields = getProposalsPublicReturnMetadataFields(
      proposalsPublicFile,
    );

    expect(schemaFields).toEqual(storeProposalFields);
    expect(publicReturnFields).toEqual(storeProposalFields);
  });

  it("accepts every proposal heading metadata field written by the v1 client", () => {
    const proposalsFile = path.resolve(process.cwd(), "convex/proposals.ts");
    const schemaFile = path.resolve(process.cwd(), "convex/schema.ts");
    const proposalsPublicFile = path.resolve(
      process.cwd(),
      "convex/proposalsPublic.ts",
    );
    const createProposalPublicFile = path.resolve(
      process.cwd(),
      "convex/createProposalPublic.ts",
    );
    const updateProposalPublicFile = path.resolve(
      process.cwd(),
      "convex/updateProposalPublic.ts",
    );
    const metadataContracts = [
      getStoreProposalMetadataFields(proposalsFile),
      getProposalSchemaMetadataFields(schemaFile),
      getProposalsPublicReturnMetadataFields(proposalsPublicFile),
      getDefaultMutationMetadataFields(createProposalPublicFile),
      getDefaultMutationMetadataFields(updateProposalPublicFile),
    ];

    metadataContracts.forEach((fields) => {
      expect(fields).toEqual(
        expect.arrayContaining(proposalHeadingMetadataFields),
      );
    });
  });

});
