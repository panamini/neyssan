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
  throw new Error(
    `Unsupported property name kind: ${ts.SyntaxKind[name.kind]}`,
  );
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

function findObjectLiteralByVariableName(
  sourceFile: ts.SourceFile,
  variableName: string,
): ts.ObjectLiteralExpression {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === variableName &&
        declaration.initializer &&
        ts.isCallExpression(declaration.initializer)
      ) {
        const [firstArg] = declaration.initializer.arguments;
        if (firstArg && ts.isObjectLiteralExpression(firstArg)) {
          return firstArg;
        }
      }
    }
  }
  throw new Error(`Unable to locate variable "${variableName}".`);
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

function getObjectLiteralFromNestedCall(
  expression: ts.Expression,
): ts.ObjectLiteralExpression {
  if (ts.isObjectLiteralExpression(expression)) {
    return expression;
  }
  if (ts.isCallExpression(expression)) {
    const [firstArg] = expression.arguments;
    if (firstArg && ts.isObjectLiteralExpression(firstArg)) {
      return firstArg;
    }
    if (
      ts.isPropertyAccessExpression(expression.expression) &&
      ts.isCallExpression(expression.expression.expression)
    ) {
      return getObjectLiteralFromNestedCall(expression.expression.expression);
    }
    if (firstArg) {
      return getObjectLiteralFromNestedCall(firstArg);
    }
  }
  throw new Error("Expected nested call to receive an object literal.");
}

function getMetadataFieldNamesFromObjectLiteral(
  objectLiteral: ts.ObjectLiteralExpression,
): string[] {
  return objectLiteral.properties
    .filter(ts.isPropertyAssignment)
    .map((property) => getPropertyName(property.name));
}

function getMetadataFieldsFromProfilesLegacyArgs(filePath: string): string[] {
  const sourceFile = parseSourceFile(filePath);
  const patchConfig = findObjectLiteralByVariableName(sourceFile, "patch");
  const argsProperty = getPropertyAssignment(patchConfig, "args");
  if (!ts.isObjectLiteralExpression(argsProperty.initializer)) {
    throw new Error("Expected patch args to be an object literal.");
  }
  const profileProperty = getPropertyAssignment(
    argsProperty.initializer,
    "profile",
  );
  if (!ts.isCallExpression(profileProperty.initializer)) {
    throw new Error("Expected profile validator to be a call expression.");
  }
  const profileArg = getObjectLiteralFromNestedCall(
    profileProperty.initializer,
  );
  const metadataProperty = getPropertyAssignment(profileArg, "metadata");
  if (!ts.isCallExpression(metadataProperty.initializer)) {
    throw new Error("Expected metadata validator to be a call expression.");
  }
  const [metadataArg] = metadataProperty.initializer.arguments;
  if (!metadataArg || !ts.isIdentifier(metadataArg)) {
    throw new Error(
      "Expected metadata validator to reuse a shared identifier.",
    );
  }
  return [metadataArg.text];
}

function getMetadataFieldsFromDefaultMutationProfileArgs(
  filePath: string,
): string[] {
  const sourceFile = parseSourceFile(filePath);
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportAssignment(statement) ||
      !ts.isCallExpression(statement.expression)
    ) {
      continue;
    }
    const [configArg] = statement.expression.arguments;
    if (!configArg || !ts.isObjectLiteralExpression(configArg)) {
      continue;
    }
    const argsProperty = getPropertyAssignment(configArg, "args");
    if (!ts.isObjectLiteralExpression(argsProperty.initializer)) {
      throw new Error(
        "Expected default mutation args to be an object literal.",
      );
    }
    const profileProperty = getPropertyAssignment(
      argsProperty.initializer,
      "profile",
    );
    if (!ts.isCallExpression(profileProperty.initializer)) {
      throw new Error(
        "Expected default mutation profile validator to be a call expression.",
      );
    }
    const [profileArg] = profileProperty.initializer.arguments;
    if (!profileArg || !ts.isObjectLiteralExpression(profileArg)) {
      throw new Error(
        "Expected default mutation profile validator to contain an object literal.",
      );
    }
    const metadataProperty = getPropertyAssignment(profileArg, "metadata");
    if (!ts.isCallExpression(metadataProperty.initializer)) {
      throw new Error(
        "Expected default mutation metadata validator to be a call expression.",
      );
    }
    const [metadataArg] = metadataProperty.initializer.arguments;
    if (!metadataArg || !ts.isIdentifier(metadataArg)) {
      throw new Error(
        "Expected default mutation metadata validator to reuse a shared identifier.",
      );
    }
    return [metadataArg.text];
  }
  throw new Error("Unable to locate default mutation metadata validator.");
}

function getMetadataFieldsFromSchema(filePath: string): string[] {
  const sourceFile = parseSourceFile(filePath);
  const tableArg = getUserProfilesTableObject(sourceFile);
  const metadataProperty = getPropertyAssignment(tableArg, "metadata");
  if (!ts.isCallExpression(metadataProperty.initializer)) {
    throw new Error("Expected metadata validator to be a call expression.");
  }
  const [metadataArg] = metadataProperty.initializer.arguments;
  if (!metadataArg || !ts.isIdentifier(metadataArg)) {
    throw new Error(
      "Expected schema metadata validator to reuse a shared identifier.",
    );
  }
  return [metadataArg.text];
}

function getUserProfilesTableObject(
  sourceFile: ts.SourceFile,
): ts.ObjectLiteralExpression {
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportAssignment(statement) ||
      !ts.isCallExpression(statement.expression)
    ) {
      continue;
    }
    const [schemaArg] = statement.expression.arguments;
    if (!schemaArg || !ts.isObjectLiteralExpression(schemaArg)) {
      continue;
    }
    const userProfiles = getPropertyAssignment(schemaArg, "userProfiles");
    if (!ts.isCallExpression(userProfiles.initializer)) {
      throw new Error("Expected userProfiles to be defined via defineTable.");
    }
    return getObjectLiteralFromNestedCall(userProfiles.initializer);
  }
  throw new Error("Unable to locate userProfiles schema table.");
}

function collectValidatorLiteralValues(expression: ts.Expression): string[] {
  if (ts.isStringLiteral(expression)) {
    return [expression.text];
  }
  if (expression.kind === ts.SyntaxKind.NullKeyword) {
    return ["null"];
  }
  if (ts.isCallExpression(expression)) {
    return expression.arguments.flatMap((arg) =>
      collectValidatorLiteralValues(arg),
    );
  }
  if (ts.isParenthesizedExpression(expression)) {
    return collectValidatorLiteralValues(expression.expression);
  }
  return [];
}

function getMetadataFieldsFromUsersMutation(filePath: string): string[] {
  const sourceFile = parseSourceFile(filePath);
  const updateMutation = findObjectLiteralByVariableName(
    sourceFile,
    "updateUserProfile",
  );
  const argsProperty = getPropertyAssignment(updateMutation, "args");
  if (!ts.isObjectLiteralExpression(argsProperty.initializer)) {
    throw new Error("Expected updateUserProfile args to be an object literal.");
  }
  const profileDataProperty = getPropertyAssignment(
    argsProperty.initializer,
    "profileData",
  );
  if (!ts.isCallExpression(profileDataProperty.initializer)) {
    throw new Error("Expected profileData validator to be a call expression.");
  }
  const [profileDataArg] = profileDataProperty.initializer.arguments;
  if (!profileDataArg || !ts.isObjectLiteralExpression(profileDataArg)) {
    throw new Error(
      "Expected profileData validator to contain an object literal.",
    );
  }
  const metadataProperty = getPropertyAssignment(profileDataArg, "metadata");
  if (!ts.isCallExpression(metadataProperty.initializer)) {
    throw new Error(
      "Expected users metadata validator to be a call expression.",
    );
  }
  const [metadataArg] = metadataProperty.initializer.arguments;
  if (!metadataArg || !ts.isIdentifier(metadataArg)) {
    throw new Error(
      "Expected users metadata validator to reuse a shared identifier.",
    );
  }
  return [metadataArg.text];
}

describe("user profile metadata schema alignment", () => {
  it("reuses the shared metadata validator across schema and strict profile mutations", () => {
    const schemaFile = path.resolve(process.cwd(), "convex/schema.ts");
    const profilesFile = path.resolve(process.cwd(), "convex/profiles.ts");
    const profilesPublicFile = path.resolve(
      process.cwd(),
      "convex/profilesPublic.ts",
    );
    const usersFile = path.resolve(process.cwd(), "convex/users.ts");

    expect(getMetadataFieldsFromSchema(schemaFile)).toEqual([
      "userProfileMetadataValidator",
    ]);
    expect(getMetadataFieldsFromProfilesLegacyArgs(profilesFile)).toEqual([
      "userProfileMetadataValidator",
    ]);
    expect(
      getMetadataFieldsFromDefaultMutationProfileArgs(profilesPublicFile),
    ).toEqual(["userProfileMetadataValidator"]);
    expect(getMetadataFieldsFromUsersMutation(usersFile)).toEqual([
      "userProfileMetadataValidator",
    ]);
  });

  it("keeps the shared metadata validator field set stable", async () => {
    const { userProfileMetadataValidator } = await import(
      "../userProfileMetadata"
    );
    expect(
      getMetadataFieldNamesFromObjectLiteral(
        findObjectLiteralByVariableName(
          parseSourceFile(
            path.resolve(process.cwd(), "convex/lib/userProfileMetadata.ts"),
          ),
          "userProfileMetadataValidator",
        ),
      ),
    ).toEqual([
      "source",
      "importedAt",
      "confidence",
      "filename",
      "verbatiStyle",
      "verbatiStyleSlotId",
      "verbatiStyleSlotSource",
      "verbatiStyleSlotNameSnapshot",
      "verbatiStyleBaseSnapshot",
      "documentStyleVersion",
    ]);
    expect(Object.keys(userProfileMetadataValidator.fields)).toEqual([
      "source",
      "importedAt",
      "confidence",
      "filename",
      "verbatiStyle",
      "verbatiStyleSlotId",
      "verbatiStyleSlotSource",
      "verbatiStyleSlotNameSnapshot",
      "verbatiStyleBaseSnapshot",
      "documentStyleVersion",
    ]);
  });

  it("keeps saved proposal preset palettes accepted by the user profile row schema", () => {
    const sourceFile = parseSourceFile(
      path.resolve(process.cwd(), "convex/schema.ts"),
    );
    const presetSlotChoice = findObjectLiteralByVariableName(
      sourceFile,
      "proposalPresetSlotChoice",
    );
    const presetPaletteProperty = getPropertyAssignment(
      presetSlotChoice,
      "paletteOverride",
    );
    const userProfilesTable = getUserProfilesTableObject(sourceFile);
    const profilePaletteProperty = getPropertyAssignment(
      userProfilesTable,
      "proposalPaletteOverride",
    );

    expect(
      collectValidatorLiteralValues(
        profilePaletteProperty.initializer,
      ).sort(),
    ).toEqual(
      collectValidatorLiteralValues(presetPaletteProperty.initializer).sort(),
    );
  });
});
