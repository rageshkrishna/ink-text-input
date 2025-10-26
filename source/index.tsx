import React, {useState, useEffect, useRef} from 'react';
import {Text, useInput} from 'ink';
import chalk from 'chalk';
import type {Except} from 'type-fest';

type PastedSegment = {
	start: number;
	length: number;
	id: number;
};

export type Props = {
	/**
	 * Text to display when `value` is empty.
	 */
	readonly placeholder?: string;

	/**
	 * Listen to user's input. Useful in case there are multiple input components
	 * at the same time and input must be "routed" to a specific component.
	 */
	readonly focus?: boolean; // eslint-disable-line react/boolean-prop-naming

	/**
	 * Replace all chars and mask the value. Useful for password inputs.
	 */
	readonly mask?: string;

	/**
	 * Whether to show cursor and allow navigation inside text input with arrow keys.
	 */
	readonly showCursor?: boolean; // eslint-disable-line react/boolean-prop-naming

	/**
	 * Highlight pasted text
	 */
	readonly highlightPastedText?: boolean; // eslint-disable-line react/boolean-prop-naming

	/**
	 * Value to display in a text input.
	 */
	readonly value: string;

	/**
	 * Function to call when value updates.
	 */
	readonly onChange: (value: string) => void;

	/**
	 * Function to call when `Enter` is pressed, where first argument is a value of the input.
	 */
	readonly onSubmit?: (value: string) => void;
};

function TextInput({
	value: originalValue,
	placeholder = '',
	focus = true,
	mask,
	highlightPastedText = false,
	showCursor = true,
	onChange,
	onSubmit,
}: Props) {
	const [state, setState] = useState({
		cursorOffset: (originalValue || '').length,
		cursorWidth: 0,
	});

	const {cursorOffset, cursorWidth} = state;

	// Track pasted segments for large paste placeholder feature
	const [pastedSegments, setPastedSegments] = useState<PastedSegment[]>([]);
	const nextSegmentId = useRef(0);

	useEffect(() => {
		setState(previousState => {
			if (!focus || !showCursor) {
				return previousState;
			}

			const newValue = originalValue || '';

			if (previousState.cursorOffset > newValue.length - 1) {
				return {
					cursorOffset: newValue.length,
					cursorWidth: 0,
				};
			}

			return previousState;
		});
	}, [originalValue, focus, showCursor]);

	const cursorActualWidth = highlightPastedText ? cursorWidth : 0;

	// Build display value with placeholders for large pasted segments
	const buildDisplayValue = (val: string): string => {
		if (pastedSegments.length === 0) {
			return val;
		}

		// Sort segments by start position
		const sorted = [...pastedSegments].sort((a, b) => a.start - b.start);

		let result = '';
		let pos = 0;

		for (const segment of sorted) {
			// Add text before this segment
			result += val.slice(pos, segment.start);

			// Add placeholder for this segment
			result += chalk.dim(`(Pasted: ${segment.length} chars)`);

			// Move position past this segment
			pos = segment.start + segment.length;
		}

		// Add any remaining text after the last segment
		result += val.slice(pos);

		return result;
	};

	const value = mask ? mask.repeat(originalValue.length) : originalValue;
	const displayValue = buildDisplayValue(value);
	let renderedValue = displayValue;
	let renderedPlaceholder = placeholder ? chalk.grey(placeholder) : undefined;

	// Fake mouse cursor, because it's too inconvenient to deal with actual cursor and ansi escapes
	if (showCursor && focus) {
		renderedPlaceholder =
			placeholder.length > 0
				? chalk.inverse(placeholder[0]) + chalk.grey(placeholder.slice(1))
				: chalk.inverse(' ');

		// When we have pasted segments, cursor rendering is more complex
		// We need to map cursor position from actual value to display value
		if (pastedSegments.length > 0) {
			// Find which segment (if any) contains the cursor
			const segmentAtCursor = pastedSegments.find(
				seg => cursorOffset >= seg.start && cursorOffset < seg.start + seg.length,
			);

			if (segmentAtCursor) {
				// Cursor is inside a pasted segment - show it at the end of the placeholder
				renderedValue = displayValue + chalk.inverse(' ');
			} else {
				// Cursor is in regular text - need to calculate display position
				// For simplicity, just show cursor at end for now
				renderedValue = displayValue.length > 0 ? displayValue + chalk.inverse(' ') : chalk.inverse(' ');
			}
		} else {
			// Normal cursor rendering (no pasted segments)
			renderedValue = value.length > 0 ? '' : chalk.inverse(' ');

			let i = 0;

			for (const char of value) {
				const isCursorHere = i >= cursorOffset - cursorActualWidth && i <= cursorOffset;

				if (isCursorHere && char === '\n') {
					// When cursor is on a newline, show a visible cursor before the newline
					renderedValue += chalk.inverse(' ') + char;
				} else {
					renderedValue += isCursorHere ? chalk.inverse(char) : char;
				}

				i++;
			}

			if (value.length > 0 && cursorOffset === value.length) {
				renderedValue += chalk.inverse(' ');
			}
		}
	}

	useInput(
		(input, key) => {
			if (
				key.upArrow ||
				key.downArrow ||
				(key.ctrl && input === 'c') ||
				key.tab ||
				(key.shift && key.tab)
			) {
				return;
			}

			if (key.return) {
				if (onSubmit) {
					onSubmit(originalValue);
				}

				return;
			}

			let nextCursorOffset = cursorOffset;
			let nextValue = originalValue;
			let nextCursorWidth = 0;

			if (key.leftArrow) {
				if (showCursor) {
					nextCursorOffset--;

					// Skip over pasted segments when moving left
					const segmentAtNewPos = pastedSegments.find(
						seg => nextCursorOffset > seg.start && nextCursorOffset <= seg.start + seg.length,
					);
					if (segmentAtNewPos) {
						nextCursorOffset = segmentAtNewPos.start;
					}
				}
			} else if (key.rightArrow) {
				if (showCursor) {
					nextCursorOffset++;

					// Skip over pasted segments when moving right
					const segmentAtNewPos = pastedSegments.find(
						seg => nextCursorOffset >= seg.start && nextCursorOffset < seg.start + seg.length,
					);
					if (segmentAtNewPos) {
						nextCursorOffset = segmentAtNewPos.start + segmentAtNewPos.length;
					}
				}
			} else if (key.backspace || key.delete) {
				if (cursorOffset > 0) {
					// Check if we're backspacing at the end of a pasted segment (cursor just after it)
					const segmentBeforeCursor = pastedSegments.find(
						seg => cursorOffset === seg.start + seg.length,
					);

					if (segmentBeforeCursor) {
						// Delete the entire pasted segment
						nextValue =
							originalValue.slice(0, segmentBeforeCursor.start) +
							originalValue.slice(segmentBeforeCursor.start + segmentBeforeCursor.length);

						nextCursorOffset = segmentBeforeCursor.start;

						// Remove this segment and adjust positions of later segments
						setPastedSegments(prevSegments => {
							return prevSegments
								.filter(seg => seg.id !== segmentBeforeCursor.id)
								.map(seg => {
									if (seg.start > segmentBeforeCursor.start) {
										return {...seg, start: seg.start - segmentBeforeCursor.length};
									}

									return seg;
								});
						});
					} else {
						// Normal backspace - delete one character
						// But don't allow deleting if it would be inside a segment
						const wouldBeInsideSegment = pastedSegments.some(
							seg => cursorOffset - 1 >= seg.start && cursorOffset - 1 < seg.start + seg.length,
						);

						if (!wouldBeInsideSegment) {
							nextValue =
								originalValue.slice(0, cursorOffset - 1) +
								originalValue.slice(cursorOffset, originalValue.length);

							nextCursorOffset--;

							// Adjust segment positions that come after the deletion
							setPastedSegments(prevSegments => {
								return prevSegments.map(seg => {
									if (seg.start >= cursorOffset) {
										return {...seg, start: seg.start - 1};
									}

									return seg;
								});
							});
						}
					}
				}
			} else {
				// Sanitize input to replace \r with \n for proper multi-line handling
				const sanitizedInput = input.replaceAll('\r', '\n');

				nextValue =
					originalValue.slice(0, cursorOffset) +
					sanitizedInput +
					originalValue.slice(cursorOffset, originalValue.length);

				nextCursorOffset += sanitizedInput.length;

				if (sanitizedInput.length > 1) {
					nextCursorWidth = sanitizedInput.length;

					// Large paste detection: track segments >= 200 characters
					if (sanitizedInput.length >= 200) {
						setPastedSegments(prevSegments => {
							// Remove any segments that overlap with the paste position
							const nonOverlapping = prevSegments.filter(
								seg => seg.start + seg.length <= cursorOffset || seg.start >= cursorOffset,
							);

							// Adjust positions of segments that come after this insertion
							const adjusted = nonOverlapping.map(seg => {
								if (seg.start > cursorOffset) {
									return {...seg, start: seg.start + sanitizedInput.length};
								}

								return seg;
							});

							// Add new pasted segment
							const newSegment: PastedSegment = {
								start: cursorOffset,
								length: sanitizedInput.length,
								id: nextSegmentId.current++,
							};

							return [...adjusted, newSegment];
						});
					} else {
						// Small paste - update segment positions
						setPastedSegments(prevSegments => {
							return prevSegments
								.filter(seg => {
									// Remove segments that contain the insertion point
									return !(cursorOffset > seg.start && cursorOffset < seg.start + seg.length);
								})
								.map(seg => {
									// Adjust segments that come after the insertion
									if (seg.start >= cursorOffset) {
										return {...seg, start: seg.start + sanitizedInput.length};
									}

									return seg;
								});
						});
					}
				} else {
					// Single character typed - just update segment positions
					// (cursor cannot be inside a segment due to arrow key logic)
					setPastedSegments(prevSegments => {
						return prevSegments.map(seg => {
							// Adjust segments that come after the insertion
							if (seg.start >= cursorOffset) {
								return {...seg, start: seg.start + sanitizedInput.length};
							}

							return seg;
						});
					});
				}
			}

			if (cursorOffset < 0) {
				nextCursorOffset = 0;
			}

			if (cursorOffset > originalValue.length) {
				nextCursorOffset = originalValue.length;
			}

			setState({
				cursorOffset: nextCursorOffset,
				cursorWidth: nextCursorWidth,
			});

			if (nextValue !== originalValue) {
				onChange(nextValue);
			}
		},
		{isActive: focus},
	);

	return (
		<Text>
			{placeholder
				? value.length > 0
					? renderedValue
					: renderedPlaceholder
				: renderedValue}
		</Text>
	);
}

export default TextInput;

type UncontrolledProps = {
	/**
	 * Initial value.
	 */
	readonly initialValue?: string;
} & Except<Props, 'value' | 'onChange'>;

export function UncontrolledTextInput({
	initialValue = '',
	...props
}: UncontrolledProps) {
	const [value, setValue] = useState(initialValue);

	return <TextInput {...props} value={value} onChange={setValue} />;
}
