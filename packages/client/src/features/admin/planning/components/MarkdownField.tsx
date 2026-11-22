import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PlanMarkdown } from "./PlanMarkdown";

interface MarkdownFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  maxLength: number;
  placeholder?: string;
}

export function MarkdownField({
  id,
  label,
  value,
  onChange,
  rows,
  maxLength,
  placeholder,
}: MarkdownFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Tabs defaultValue="write" className="gap-2">
        <TabsList className="text-foreground/80">
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="write">
          <Textarea
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
            className="font-mono text-sm"
          />
        </TabsContent>
        <TabsContent
          value="preview"
          className="min-h-24 rounded-md border border-border p-3"
        >
          {value.trim() ? (
            <PlanMarkdown text={value} />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview.</p>
          )}
        </TabsContent>
      </Tabs>
      <FieldDescription>Markdown is supported.</FieldDescription>
    </Field>
  );
}
