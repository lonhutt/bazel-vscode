import * as fs from "fs";

const COMMENT_REGEX = /#(.)*(\n|\z)/gm;
const HEADER_REGEX = /^[^:\-\/*\s]+[: ]/gm;
const WHITESPACE_CHAR_REGEX = /\s+/;
const EXCLUDED_ENTRY_PREFIX = "-";

function parseProjectFile(filePath: string): BazelProjectFile {
  if (fs.existsSync(filePath)) {
    let fileContent = fs.readFileSync(filePath, { encoding: "utf-8" });
    fileContent = removeComments(fileContent);

    const rawSections = parseRawSections(fileContent);

    return { directories: parseDirectories(rawSections), targets: parseTargets(rawSections) };
  } else {
    return {directories: [], targets: []};
  }
}

function parseDirectories(rawSections: RawSection[]): string[] {
  return parseNamedSection("directories", rawSections)
    .filter((s) => s !== EXCLUDED_ENTRY_PREFIX);
}

function parseTargets(rawSections: RawSection[]): string[] {
  return parseNamedSection("targets", rawSections)
    .filter((s) => s !== EXCLUDED_ENTRY_PREFIX);
}

function parseNamedSection(
  sectionName: string,
  rawSections: RawSection[]
): string[] {
  return rawSections
    .filter((rs) => rs.name === sectionName)
    .flatMap((rs) => rs.body.split(WHITESPACE_CHAR_REGEX))
    .filter((v) => v !== "");
}

function parseRawSections(projectFileContents: string): RawSection[] {
  const result = new Array<RawSection>();

  let headers = projectFileContents
    .match(HEADER_REGEX)
    ?.map(h => h.replace(':', ''));


  let bodies = projectFileContents.split(HEADER_REGEX);

  if (headers?.length !== bodies.length - 1) {
    throw new Error(
      `Syntax error in .bazelproject: The number of section headers doesn't match the number of section bodies (${
        headers?.length
      } != ${bodies.length}; header: ${headers?.join(",")}).`
    );
  }

  headers.forEach((value, idx) =>
    result.push({ name: value, body: bodies[idx + 1].trim() })
  );

  return result;
}

function removeComments(bazelProjectFileContent: string): string {
  return bazelProjectFileContent.replace(COMMENT_REGEX, "\n");
}

export interface BazelProjectFile {
  directories: string[];
  targets: string[];
}

interface RawSection {
  name: string;
  body: string;
}

export function readBazelProject(bazelProjectFile: string): BazelProjectFile {
  return parseProjectFile(bazelProjectFile);
}
