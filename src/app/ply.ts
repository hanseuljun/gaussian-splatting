async function readPlyFile(file_path: string) {
    try {
      const response = await fetch(file_path);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const buffer = await response.arrayBuffer();
      const decoder = new TextDecoder("utf-8");
      const plyText = decoder.decode(buffer.slice(0, 10000));
      const lastHeaderIndex = plyText.indexOf("end_header") + "end_header".length + 1;
      const plySubText = plyText.slice(undefined, lastHeaderIndex);

      let vertexCount = 0;
      const properties = [];
      const lines = plySubText.split('\n');
      for (const line of lines) {
        if (line.startsWith('element vertex ')) {
          vertexCount = parseInt(line.split(' ')[2]);
        }
        else if (line.startsWith('property float ')) {
          properties.push(line.split(' ')[2]);
        }
      }

      const float32Array = new Float32Array(buffer.slice(lastHeaderIndex, lastHeaderIndex + 4 * vertexCount * properties.length));
      const vertices = [];
      for (let i = 0; i < vertexCount; i++) {
        const vertex: { [key: string]: number } = {};
        for (let j = 0; j < properties.length; j++) {
          vertex[properties[j]] = float32Array[i * properties.length + j];
        }
        vertices.push(vertex);
      }
      return vertices;
    } catch (error) {
      console.error('Error loading PLY file:', error);
      return null;
    }
  }

  export default readPlyFile;
