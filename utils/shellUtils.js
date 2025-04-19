import process from 'process';
import chalk from "chalk";

export function printDivider(divider_color) {
    const terminalWidth = process.stdout.columns;
    let pattern = '-';
    const repeatCount = Math.floor(terminalWidth / pattern.length);
    pattern = pattern.repeat(repeatCount);
    console.log(`\n${chalk[divider_color](pattern)}`);
}

export function printDividerWithText(text, divider_color, text_color) {
    const terminalWidth = process.stdout.columns;
    let pattern = '-';
    const repeatCount = Math.floor(terminalWidth / pattern.length) - text.length - 2;
    pattern = pattern.repeat(repeatCount);
    const patternLength = pattern.length;
    const patternArr = pattern.split("");
    if ((patternLength / 2) % 2 == 0) {
        patternArr.splice(patternLength / 2, 0, ` ${chalk[text_color](text)} `);
    } else {
        patternArr.splice(patternLength / 2, 1, ` ${chalk[text_color](text)} `);
    }
    pattern = patternArr.join("");
    console.log(`\n${chalk[divider_color](pattern)}`);
}