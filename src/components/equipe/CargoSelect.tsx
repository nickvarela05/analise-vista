import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CARGOS } from "./lib/cargos";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}

export function CargoSelect({ value, onChange, placeholder = "Selecione um cargo", id }: Props) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {CARGOS.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
